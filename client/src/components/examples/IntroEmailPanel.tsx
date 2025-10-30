import IntroEmailPanel from '../IntroEmailPanel';
import { useToast } from '@/hooks/use-toast';

export default function IntroEmailPanelExample() {
  const { toast } = useToast();

  const mockMatches = [
    {
      contactA: {
        name: "Alex Chen",
        email: "alex@techflow.ai"
      },
      contactB: {
        name: "Sarah Johnson",
        email: "sarah@sequoia.com"
      },
      score: 3,
      reason: "Based on our recent conversation, Alex is raising a $2M seed round for their AI infrastructure platform. Given Sarah's focus on AI infra investments at the seed stage, this could be a great fit.",
      conversationContext: "Alex mentioned they're specifically looking for investors who understand the DevTools space and have experience with technical founders. Their current traction (500 developers, 20% MoM growth) aligns well with typical seed-stage metrics."
    },
    {
      contactA: {
        name: "Jordan Smith",
        email: "jordan@example.com"
      },
      contactB: {
        name: "Michael Park",
        email: "michael@a16z.com"
      },
      score: 3,
      reason: "Jordan expressed interest in Series A funding for DevTools companies. Michael has a strong track record in this space and could be a valuable connection.",
      conversationContext: "During the conversation, Jordan mentioned looking for investors who can provide not just capital but also strategic guidance for scaling developer adoption."
    }
  ];

  return (
    <div className="max-w-4xl p-6">
      <IntroEmailPanel
        matches={mockMatches}
        onSendEmail={(to, message) => {
          console.log('Sending to:', to);
          console.log('Message:', message);
          toast({
            title: "Email sent!",
            description: `Introduction email sent to ${to}`,
          });
        }}
      />
    </div>
  );
}
