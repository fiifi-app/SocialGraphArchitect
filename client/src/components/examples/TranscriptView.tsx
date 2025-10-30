import TranscriptView from '../TranscriptView';

export default function TranscriptViewExample() {
  const mockTranscript = [
    {
      t: new Date().toISOString(),
      speaker: "Alex Chen",
      text: "We're looking to raise a $2M seed round for our AI infrastructure platform. We're focused on making it easier for developers to deploy agentic workflows."
    },
    {
      t: new Date(Date.now() + 5000).toISOString(),
      speaker: "Jordan Smith",
      text: "That sounds interesting. What's your current traction? And are you looking specifically for investors who understand the developer tools space?"
    },
    {
      t: new Date(Date.now() + 12000).toISOString(),
      speaker: "Alex Chen",
      text: "We have about 500 developers on our platform, mostly in the Bay Area and New York. We're growing 20% month over month. Yes, ideally we'd love investors who've backed DevTools before."
    },
  ];

  return <TranscriptView transcript={mockTranscript} />;
}
