-- Add UPDATE policy for match_suggestions
CREATE POLICY "Users can update suggestions for own conversations"
  ON match_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = match_suggestions.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = match_suggestions.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  );
