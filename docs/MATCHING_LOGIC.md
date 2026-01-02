# Contact Matching Logic - Technical Documentation

This document describes the matching algorithms used in the Social Graph Connector application.

---

## Table of Contents

1. [CSV Import Column Mapping](#1-csv-import-column-mapping)
2. [Conversation-to-Contact Matching](#2-conversation-to-contact-matching)
3. [Fuzzy Name Matching](#3-fuzzy-name-matching)
4. [Utility Functions](#4-utility-functions)

---

## 1. CSV Import Column Mapping

**File:** `client/src/components/CsvUploadDialog.tsx`

When importing contacts from CSV, the system uses flexible column name matching. For each field, it checks multiple common naming conventions in priority order.

### Field Mapping Table

| Field | Accepted Column Names (checked in order) |
|-------|------------------------------------------|
| **First Name** | `First Name`, `first_name`, `firstName` |
| **Last Name** | `Last Name`, `last_name`, `lastName` |
| **Full Name** | `name`, `Name`, `full_name`, `Full Name`, `contact_name` |
| **Email** | `email`, `Email`, `email_address` |
| **Title** | `title`, `Title`, `position`, `Position` |
| **Company** | `company`, `Company`, `Company Name`, `organization`, `Organization` |
| **LinkedIn** | `linkedin`, `LinkedIn`, `Linkedin`, `linkedin_url`, `LinkedIn URL` |
| **Location** | `location`, `Location` |
| **Phone** | `phone`, `Phone` |
| **Category** | `category`, `Category`, `Catagory`, `catagory` |
| **Twitter** | `twitter`, `Twitter` |
| **AngelList** | `angellist`, `Angellist`, `Angel List`, `angel_list` |
| **Bio** | `bio`, `Bio`, `about`, `About`, `description`, `Description`, `summary`, `Summary`, `Company Description`, `company_description`, `Company About`, `company_about`, `Person Summary`, `person_summary`, `Profile`, `profile` |
| **Company Address** | `Company Address`, `company_address`, `Address`, `address`, `Company Street`, `company_street`, `HQ Address`, `hq_address` |
| **Company Employees** | `Company # of Employees`, `company_employees`, `Employees`, `employees`, `Company Size`, `company_size` |
| **Company Founded** | `Company Founded`, `company_founded`, `Founded`, `founded`, `Year Founded`, `year_founded` |
| **Company URL** | `Company URL`, `company_url`, `Website`, `website`, `Company Website`, `company_website`, `URL`, `url` |
| **Company LinkedIn** | `Company Linkedin`, `Company LinkedIn`, `company_linkedin` |
| **Company Twitter** | `Company Twitter`, `company_twitter` |
| **Company Facebook** | `Company Facebook`, `company_facebook` |

### Name Construction Logic

```javascript
const firstName = row['First Name'] || row.first_name || row.firstName || '';
const lastName = row['Last Name'] || row.last_name || row.lastName || '';

// Combine first + last if both exist, otherwise fall back to full name fields
const name = firstName && lastName 
  ? `${firstName} ${lastName}`.trim() 
  : row.name || row.Name || row.full_name || row['Full Name'] || row.contact_name || firstName || '';
```

### Validation Rules

#### Email Validation
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = emailRegex.test(email);
```

#### URL Validation
```javascript
function isValidUrl(str: string): boolean {
  if (!str || str.trim() === '') return false;
  try {
    const url = new URL(str.startsWith('http') ? str : `https://${str}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Applied to company URL field
const companyUrlRaw = row['Company URL'] || row.company_url || ...;
const companyUrl = isValidUrl(companyUrlRaw) ? companyUrlRaw : '';
```

#### LinkedIn URL Normalization
```javascript
function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  
  // Extract the profile ID/username from various formats
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  if (match) {
    return `https://www.linkedin.com/in/${match[1]}`;
  }
  
  // If it's just a username, construct the full URL
  if (!url.includes('linkedin.com') && !url.includes('/')) {
    return `https://www.linkedin.com/in/${url}`;
  }
  
  return url;
}
```

---

## 2. Conversation-to-Contact Matching

**File:** `supabase/functions/generate-matches/index.ts`

This system matches contacts from the user's network against conversation content to suggest potential introductions.

### Weighted Scoring Algorithm

The algorithm uses a weighted combination of multiple scoring factors:

```javascript
const WEIGHTS = {
  semantic: 0.20,      // Keyword matching from bio/title/notes
  tagOverlap: 0.35,    // Jaccard similarity on sectors/stages/geos
  roleMatch: 0.15,     // Investor type matching
  geoMatch: 0.10,      // Location overlap
  relationship: 0.20,  // Existing relationship strength score
};
```

### Score Calculation

```javascript
let rawScore = 
  WEIGHTS.semantic * matchDetails.semanticScore +
  WEIGHTS.tagOverlap * matchDetails.tagOverlapScore +
  WEIGHTS.roleMatch * matchDetails.roleMatchScore +
  WEIGHTS.geoMatch * matchDetails.geoMatchScore +
  WEIGHTS.relationship * matchDetails.relationshipScore;

// NAME MATCH BOOST - Add 0.3 to raw score for name mentions
if (matchDetails.nameMatch) {
  rawScore += 0.3 * matchDetails.nameMatchScore;
}

// Clamp raw score to 0-1
rawScore = Math.min(Math.max(rawScore, 0), 1);
```

### Star Rating Thresholds

```javascript
let starScore = 0;
if (rawScore >= 0.40) {
  starScore = 3;  // ⭐⭐⭐
} else if (rawScore >= 0.20) {
  starScore = 2;  // ⭐⭐
} else if (rawScore >= 0.05) {
  starScore = 1;  // ⭐
}

// Only include matches with score >= 1 star
if (starScore >= 1) {
  // Include in results
}
```

### Individual Scoring Components

#### 2.1 Semantic Score (20% weight)

Keyword matching between conversation entities and contact profile text:

```javascript
const contactText = [
  contact.bio || '',
  contact.title || '',
  contact.investor_notes || '',
  contact.company || ''
].join(' ').toLowerCase();

// Check for sector keyword matches in contact text
let keywordMatches = 0;
const allSearchTerms = [...sectors, ...stages, ...conversationTags];

for (const term of allSearchTerms) {
  if (contactText.includes(term.toLowerCase())) {
    keywordMatches++;
  }
}

matchDetails.semanticScore = allSearchTerms.length > 0 
  ? Math.min(keywordMatches / Math.max(allSearchTerms.length, 1), 1)
  : 0;
```

#### 2.2 Tag Overlap Score (35% weight)

Uses Jaccard similarity between conversation tags and contact tags:

```javascript
// Build contact tags from theses and profile
const contactTags: string[] = [];
const theses = contact.theses || [];

for (const thesis of theses) {
  contactTags.push(...(thesis.sectors || []));
  contactTags.push(...(thesis.stages || []));
  contactTags.push(...(thesis.geos || []));
}

// Add contact type tags
if (contact.contact_type) {
  contactTags.push(...contact.contact_type);
}
if (contact.is_investor) {
  contactTags.push('investor');
}

// Extract keywords from bio/title/investor_notes
const investmentTerms = [
  'venture', 'capital', 'seed', 'series a', 'series b', 'pre-seed', 
  'biotech', 'fintech', 'healthtech', 'saas', 'ai', 'ml', 'deep tech', 
  'climate', 'enterprise', 'b2b', 'b2c', 'consumer', 'healthcare', 'life sciences'
];

for (const term of investmentTerms) {
  if (bioText.includes(term) || titleText.includes(term) || notesText.includes(term)) {
    contactTags.push(term);
  }
}

matchDetails.tagOverlapScore = jaccardSimilarity(conversationTags, contactTags);
```

#### 2.3 Role Match Score (15% weight)

Matches investor types from conversation against contact's role:

```javascript
// If conversation mentions looking for specific investor types
// and contact has matching investor type tags (GP, Angel, LP, etc.)
// Score is 1.0 for match, 0 for no match
```

#### 2.4 Geographic Match Score (10% weight)

Matches geographic focus areas:

```javascript
// Compares conversation geos (e.g., "Bay Area", "NYC", "Europe")
// against contact's geographic tags from their thesis
// Score is 1.0 for match, 0 for no match
```

#### 2.5 Relationship Strength Score (20% weight)

Uses the `relationship_strength` field (0-100) from the contacts table:

```javascript
matchDetails.relationshipScore = (contact.relationship_strength || 0) / 100;
```

### AI Explanation Generation

For 2+ star matches, the system generates AI explanations using GPT-4o-mini:

```javascript
const openai = new OpenAI({ apiKey: openaiKey });
const matchesToExplain = topMatches.filter(m => m.score >= 2).slice(0, 5);

for (const match of matchesToExplain) {
  const prompt = `You are an expert connector who helps facilitate warm introductions...
  
CONVERSATION CONTEXT:
${transcriptSummary}
Topics discussed: ${conversationTags.slice(0, 10).join(', ')}
${fundraisingContext}
${hiringContext}

POTENTIAL CONNECTION:
Name: ${match.contact_name}
Role: ${match.contactInfo?.title}
Company: ${match.contactInfo?.company}
About: ${match.contactInfo?.bio}
Match reasons: ${match.reasons.join(', ')}

Write a warm, professional explanation (1-2 sentences)...`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0.7,
  });
  
  match.ai_explanation = response.choices[0]?.message?.content?.trim();
}
```

---

## 3. Fuzzy Name Matching

**File:** `supabase/functions/generate-matches/index.ts`

The `fuzzyNameMatch` function provides flexible name matching with similarity scoring.

### Match Types and Scores

| Match Type | Score | Description |
|------------|-------|-------------|
| `exact` | 1.00 | Exact string match |
| `contains` | 0.95 | One name contains the other (e.g., "Roy Bahat" in "Roy E. Bahat") |
| `full` | 0.90 | First + last name match exactly |
| `nickname-full` | 0.85 | First name is nickname + last name matches |
| `first-only` | 0.70 | Only first name mentioned, exact match |
| `first-nickname` | 0.65 | Only first name mentioned, nickname match |
| `levenshtein` | 0.60 | Close spelling (Levenshtein distance ≤ 2) |
| `partial` | 0.50 | First or last name matches |
| `none` | 0.00 | No match |

### Nickname Mapping

```javascript
const nicknames: Record<string, string[]> = {
  'matt': ['matthew', 'mat'],
  'matthew': ['matt', 'mat'],
  'rob': ['robert', 'bob', 'bobby'],
  'robert': ['rob', 'bob', 'bobby'],
  'bob': ['robert', 'rob', 'bobby'],
  'mike': ['michael', 'mick'],
  'michael': ['mike', 'mick'],
  'jim': ['james', 'jimmy'],
  'james': ['jim', 'jimmy'],
  'bill': ['william', 'will', 'billy'],
  'william': ['bill', 'will', 'billy'],
  'dan': ['daniel', 'danny'],
  'daniel': ['dan', 'danny'],
  'tom': ['thomas', 'tommy'],
  'thomas': ['tom', 'tommy'],
  'joe': ['joseph', 'joey'],
  'joseph': ['joe', 'joey'],
  'alex': ['alexander', 'alexandra', 'alexis'],
  'alexander': ['alex'],
  'chris': ['christopher', 'christine', 'christina'],
  'christopher': ['chris'],
  'nick': ['nicholas', 'nicolas'],
  'nicholas': ['nick'],
  'sam': ['samuel', 'samantha'],
  'samuel': ['sam'],
  'ben': ['benjamin', 'benny'],
  'benjamin': ['ben', 'benny'],
  'steve': ['steven', 'stephen'],
  'steven': ['steve'],
  'stephen': ['steve'],
  'dave': ['david'],
  'david': ['dave'],
  'tony': ['anthony'],
  'anthony': ['tony'],
  'ed': ['edward', 'edwin', 'eddie'],
  'edward': ['ed', 'eddie'],
  'rick': ['richard', 'ricky', 'dick'],
  'richard': ['rick', 'ricky', 'dick'],
  'andy': ['andrew'],
  'andrew': ['andy'],
  'pat': ['patrick', 'patricia'],
  'patrick': ['pat'],
  'jen': ['jennifer', 'jenny'],
  'jennifer': ['jen', 'jenny'],
  'kate': ['katherine', 'catherine', 'kathy'],
  'katherine': ['kate', 'kathy'],
  'liz': ['elizabeth', 'beth', 'lizzy'],
  'elizabeth': ['liz', 'beth', 'lizzy'],
};
```

### Full Implementation

```javascript
function fuzzyNameMatch(mentionedName: string, contactName: string): { 
  match: boolean; 
  score: number; 
  type: string 
} {
  const mentioned = mentionedName.toLowerCase().trim();
  const contact = contactName.toLowerCase().trim();
  
  // Exact match
  if (mentioned === contact) {
    return { match: true, score: 1.0, type: 'exact' };
  }
  
  // One contains the other (e.g., "Roy Bahat" in "Roy E. Bahat")
  if (contact.includes(mentioned) || mentioned.includes(contact)) {
    return { match: true, score: 0.95, type: 'contains' };
  }
  
  // Split into parts
  const mentionedParts = mentioned.split(/\s+/).filter(p => p.length > 1);
  const contactParts = contact.split(/\s+/).filter(p => p.length > 1);
  
  // Handle single-word names (first name only match)
  if (mentionedParts.length === 1 && contactParts.length >= 1) {
    const singleName = mentionedParts[0];
    const contactFirst = contactParts[0];
    
    // Exact first name match
    if (singleName === contactFirst) {
      return { match: true, score: 0.7, type: 'first-only' };
    }
    
    // Nickname match for first name
    if (nicknames[singleName]?.includes(contactFirst) || 
        nicknames[contactFirst]?.includes(singleName)) {
      return { match: true, score: 0.65, type: 'first-nickname' };
    }
    
    return { match: false, score: 0, type: 'none' };
  }
  
  // Need at least 2 parts for mentioned and 1 for contact
  if (mentionedParts.length < 2 || contactParts.length < 1) {
    return { match: false, score: 0, type: 'none' };
  }
  
  const mentionedFirst = mentionedParts[0];
  const mentionedLast = mentionedParts[mentionedParts.length - 1];
  const contactFirst = contactParts[0];
  const contactLast = contactParts[contactParts.length - 1];
  
  // Check for full name match (first + last)
  const firstMatches = mentionedFirst === contactFirst || 
    nicknames[mentionedFirst]?.includes(contactFirst) || 
    nicknames[contactFirst]?.includes(mentionedFirst);
  const lastMatches = mentionedLast === contactLast;
  
  if (firstMatches && lastMatches) {
    const isNickname = mentionedFirst !== contactFirst;
    return { 
      match: true, 
      score: isNickname ? 0.85 : 0.90, 
      type: isNickname ? 'nickname-full' : 'full' 
    };
  }
  
  // Levenshtein distance for close matches
  const distance = levenshteinDistance(mentioned, contact);
  if (distance <= 2 && mentioned.length > 4) {
    return { match: true, score: 0.60, type: 'levenshtein' };
  }
  
  // Partial match (first OR last matches)
  if (firstMatches || lastMatches) {
    return { match: true, score: 0.50, type: 'partial' };
  }
  
  return { match: false, score: 0, type: 'none' };
}
```

---

## 4. Utility Functions

### Levenshtein Distance

Calculates edit distance between two strings:

```javascript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j] + 1       // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}
```

### Jaccard Similarity

Calculates set overlap for tag matching:

```javascript
function jaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 0;
  
  const s1 = new Set(set1.map(s => s.toLowerCase()));
  const s2 = new Set(set2.map(s => s.toLowerCase()));
  
  const intersection = [...s1].filter(x => s2.has(x)).length;
  const union = new Set([...s1, ...s2]).size;
  
  return union > 0 ? intersection / union : 0;
}
```

### Check Size Parsing

Converts check size strings to numbers:

```javascript
function parseCheckSize(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, '').toLowerCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/);
  if (!match) return null;
  
  let num = parseFloat(match[1]);
  const suffix = match[2];
  
  if (suffix === 'k' || suffix === 'thousand') num *= 1000;
  if (suffix === 'm' || suffix === 'million') num *= 1000000;
  
  return num;
}

// Examples:
// "$5M" → 5000000
// "500k" → 500000
// "$2.5 million" → 2500000
// "10,000" → 10000
```

### Partial String Matching

Checks if a value matches any item in an array:

```javascript
function matchesAny(value: string, items: string[]): boolean {
  const valueLower = value.toLowerCase();
  return items.some(item => {
    const itemLower = item.toLowerCase();
    return valueLower.includes(itemLower) || itemLower.includes(valueLower);
  });
}
```

---

## Database Schema References

### Contacts Table (relevant fields)

```sql
contacts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  company TEXT,
  bio TEXT,
  location TEXT,
  contact_type TEXT[],        -- ['GP', 'Angel', 'LP', 'Startup', etc.]
  is_investor BOOLEAN,
  investor_notes TEXT,
  relationship_strength INTEGER,  -- 0-100
  ...
)
```

### Investment Theses Table

```sql
investment_theses (
  id UUID PRIMARY KEY,
  contact_id UUID REFERENCES contacts,
  sectors TEXT[],             -- ['SaaS', 'Fintech', 'AI']
  stages TEXT[],              -- ['Seed', 'Series A']
  geos TEXT[],                -- ['Bay Area', 'NYC']
  check_size_min INTEGER,
  check_size_max INTEGER,
  keywords TEXT[],
  ...
)
```

### Match Suggestions Table

```sql
match_suggestions (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations,
  contact_id UUID REFERENCES contacts,
  score INTEGER,              -- Star rating 1-3
  raw_score FLOAT,            -- 0.0-1.0 weighted score
  reasons TEXT[],
  ai_explanation TEXT,
  ...
)
```

---

## Version History

- **v1.0** - Initial implementation with weighted scoring
- **v1.1** - Added fuzzy name matching with nicknames
- **v1.2** - Increased tag overlap weight, added AI explanations
- **v1.3** - Added URL validation for CSV imports

---

*Last updated: January 2026*
