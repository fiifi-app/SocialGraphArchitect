import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;
const MAX_TIME_MS = 50000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      if (data.user) {
        userId = data.user.id;
      }
    }

    let query = supabase.from("pipeline_jobs").select("*").eq("enabled", true);
    if (userId) {
      query = query.eq("owned_by_profile", userId);
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      throw new Error("Failed to fetch jobs: " + jobsError.message);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active pipelines" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const job of jobs) {
      if (Date.now() - startTime > MAX_TIME_MS) {
        break;
      }

      try {
        const result = await processPipeline(supabase, job, openaiKey, startTime);
        results.push({ userId: job.owned_by_profile, ...result });
      } catch (err) {
        console.error("Error processing pipeline:", err);
        await supabase.from("pipeline_jobs").update({
          last_error: String(err),
          error_count: (job.error_count || 0) + 1,
        }).eq("id", job.id);
        results.push({ userId: job.owned_by_profile, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Pipeline batch error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processPipeline(supabase: any, pipeline: any, openaiKey: string, startTime: number) {
  const userId = pipeline.owned_by_profile;

  await supabase.from("pipeline_jobs").update({
    status: "running",
    last_run_at: new Date().toISOString(),
  }).eq("id", pipeline.id);

  const stage = pipeline.current_stage || "enrichment";
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  if (stage === "enrichment") {
    const result = await processEnrichmentBatch(supabase, pipeline, openaiKey, startTime);
    processed = result.processed;
    succeeded = result.succeeded;
    failed = result.failed;

    await supabase.from("pipeline_jobs").update({
      enrich_processed: (pipeline.enrich_processed || 0) + processed,
      enrich_succeeded: (pipeline.enrich_succeeded || 0) + succeeded,
      enrich_failed: (pipeline.enrich_failed || 0) + failed,
      current_stage: result.completed ? "extraction" : "enrichment",
    }).eq("id", pipeline.id);

  } else if (stage === "extraction") {
    const result = await processExtractionBatch(supabase, pipeline, openaiKey, startTime);
    processed = result.processed;
    succeeded = result.succeeded;
    failed = result.failed;

    await supabase.from("pipeline_jobs").update({
      thesis_processed: (pipeline.thesis_processed || 0) + processed,
      thesis_succeeded: (pipeline.thesis_succeeded || 0) + succeeded,
      thesis_failed: (pipeline.thesis_failed || 0) + failed,
      current_stage: result.completed ? "embedding" : "extraction",
    }).eq("id", pipeline.id);

  } else if (stage === "embedding") {
    const result = await processEmbeddingBatch(supabase, pipeline, openaiKey, startTime);
    processed = result.processed;
    succeeded = result.succeeded;
    failed = result.failed;

    const hasMoreWork = await checkForMoreWork(supabase, userId);

    await supabase.from("pipeline_jobs").update({
      embed_processed: (pipeline.embed_processed || 0) + processed,
      embed_succeeded: (pipeline.embed_succeeded || 0) + succeeded,
      embed_failed: (pipeline.embed_failed || 0) + failed,
      current_stage: result.completed ? "enrichment" : "embedding",
      status: hasMoreWork ? "running" : "idle",
      completed_at: (!hasMoreWork && result.completed) ? new Date().toISOString() : null,
    }).eq("id", pipeline.id);
  }

  return { stage, processed, succeeded, failed };
}

async function checkForMoreWork(supabase: any, userId: string) {
  const { count: needsEnrich } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("owned_by_profile", userId)
    .not("name", "is", null)
    .is("bio", null);

  const { count: needsThesis } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("owned_by_profile", userId)
    .or("bio.not.is.null,title.not.is.null,investor_notes.not.is.null")
    .is("thesis_sectors", null)
    .is("thesis_stages", null);

  const { count: needsEmbed } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("owned_by_profile", userId)
    .not("bio", "is", null)
    .is("bio_embedding", null);

  return (needsEnrich || 0) > 0 || (needsThesis || 0) > 0 || (needsEmbed || 0) > 0;
}

async function processEnrichmentBatch(supabase: any, pipeline: any, openaiKey: string, startTime: number) {
  const userId = pipeline.owned_by_profile;

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, company, title, bio")
    .eq("owned_by_profile", userId)
    .not("name", "is", null)
    .is("bio", null)
    .order("id")
    .limit(BATCH_SIZE);

  if (error) throw error;

  if (!contacts || contacts.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, completed: true };
  }

  let succeeded = 0;
  let failed = 0;

  for (const contact of contacts) {
    if (Date.now() - startTime > MAX_TIME_MS) break;

    try {
      const bio = await generateBio(contact, openaiKey);
      if (bio) {
        await supabase.from("contacts").update({ bio }).eq("id", contact.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error("Failed to enrich " + contact.name + ":", e);
      failed++;
    }
  }

  return { processed: contacts.length, succeeded, failed, completed: contacts.length < BATCH_SIZE };
}

async function processExtractionBatch(supabase: any, pipeline: any, openaiKey: string, startTime: number) {
  const userId = pipeline.owned_by_profile;

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, bio, title, investor_notes")
    .eq("owned_by_profile", userId)
    .not("bio", "is", null)
    .order("id")
    .limit(BATCH_SIZE * 2);

  if (error) throw error;
  if (!contacts || contacts.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, completed: true };
  }

  const contactIds = contacts.map((c: any) => c.id);
  const { data: existingTheses } = await supabase
    .from("theses")
    .select("contact_id")
    .in("contact_id", contactIds);

  const thesisIds = new Set((existingTheses || []).map((t: any) => t.contact_id));
  const needsThesis = contacts.filter((c: any) => !thesisIds.has(c.id)).slice(0, BATCH_SIZE);

  if (needsThesis.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, completed: true };
  }

  let succeeded = 0;
  let failed = 0;

  for (const contact of needsThesis) {
    if (Date.now() - startTime > MAX_TIME_MS) break;

    try {
      const thesis = await extractThesis(contact, openaiKey);
      if (thesis) {
        await supabase.from("theses").upsert({
          contact_id: contact.id,
          sectors: thesis.sectors || [],
          stages: thesis.stages || [],
          check_size_min: thesis.check_size_min || null,
          check_size_max: thesis.check_size_max || null,
          geos: thesis.geos || [],
          personas: thesis.keywords || [],
          notes: thesis.summary || "",
        }, { onConflict: "contact_id" });
        succeeded++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error("Failed to extract thesis for " + contact.name + ":", e);
      failed++;
    }
  }

  return { processed: needsThesis.length, succeeded, failed, completed: needsThesis.length < BATCH_SIZE };
}

async function processEmbeddingBatch(supabase: any, pipeline: any, openaiKey: string, startTime: number) {
  const userId = pipeline.owned_by_profile;

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, bio, title, investor_notes")
    .eq("owned_by_profile", userId)
    .not("bio", "is", null)
    .is("bio_embedding", null)
    .order("id")
    .limit(BATCH_SIZE);

  if (error) throw error;

  if (!contacts || contacts.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, completed: true };
  }

  let succeeded = 0;
  let failed = 0;

  for (const contact of contacts) {
    if (Date.now() - startTime > MAX_TIME_MS) break;

    try {
      const textToEmbed = [contact.bio, contact.title, contact.investor_notes]
        .filter(Boolean)
        .join(" ");

      const embedding = await generateEmbedding(textToEmbed, openaiKey);
      if (embedding) {
        await supabase.from("contacts").update({ bio_embedding: embedding }).eq("id", contact.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error("Failed to generate embedding for " + contact.name + ":", e);
      failed++;
    }
  }

  return { processed: contacts.length, succeeded, failed, completed: contacts.length < BATCH_SIZE };
}

async function generateBio(contact: any, apiKey: string) {
  const prompt = "Generate a brief professional bio (2-3 sentences) for this person:\nName: " + contact.name + "\nCompany: " + (contact.company || "Unknown") + "\nTitle: " + (contact.title || "Unknown") + "\n\nWrite a professional summary that could appear on LinkedIn. Be concise and factual.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function extractThesis(contact: any, apiKey: string) {
  const content = [contact.bio, contact.title, contact.investor_notes].filter(Boolean).join("\n");

  const prompt = "Analyze this person's profile and extract investment/professional thesis information.\n\nProfile:\n" + content + "\n\nReturn JSON with these fields:\n- sectors: array of industry sectors (e.g., FinTech, HealthTech, SaaS)\n- stages: array of investment stages if investor (e.g., Seed, Series A)\n- check_size_min: minimum check size in dollars (number only)\n- check_size_max: maximum check size in dollars (number only)\n- geos: array of geographic focus areas\n- keywords: array of 3-5 key focus areas or expertise\n- summary: one sentence summary of their focus\n\nReturn only valid JSON, no markdown.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function generateEmbedding(text: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });

  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}
