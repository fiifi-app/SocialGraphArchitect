import IntroEmailTemplate from '../IntroEmailTemplate';
import { useToast } from '@/hooks/use-toast';

export default function IntroEmailTemplateExample() {
  const { toast } = useToast();

  return (
    <div className="max-w-3xl p-6 space-y-6">
      <IntroEmailTemplate
        recipientName="Sarah Johnson"
        recipientEmail="sarah@sequoia.com"
        introducingTo="Alex Chen (Founder, TechFlow AI)"
        reason="Based on our recent conversation, I learned that Alex is raising a $2M seed round for their AI infrastructure platform. Given your focus on AI infra investments at the seed stage, I thought this could be a great fit."
        conversationContext="Alex mentioned they're specifically looking for investors who understand the DevTools space and have experience with technical founders. Their current traction (500 developers, 20% MoM growth) aligns well with your typical investment criteria."
        introBullets={[
          "Raising $2M seed for AI infrastructure platform",
          "500 developers on platform, 20% MoM growth",
          "Looking for investors with DevTools expertise",
          "Strong technical team focused on agentic workflows"
        ]}
        onSend={(message) => {
          console.log('Sending email:', message);
          toast({
            title: "Email sent!",
            description: "Your introduction email has been sent to Sarah Johnson.",
          });
        }}
        onCopy={(message) => {
          console.log('Copied:', message);
          toast({
            title: "Copied to clipboard",
            description: "Email text has been copied.",
          });
        }}
      />
    </div>
  );
}
