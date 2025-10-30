import SuggestionCard from '../SuggestionCard';

export default function SuggestionCardExample() {
  return (
    <div className="space-y-4 max-w-md p-4">
      <SuggestionCard
        contactName="Sarah Johnson"
        score={3}
        reasons={[
          "Invests in AI infra at seed stage ($1-3M)",
          "Based in SF, matches geo preference",
          "Recently met 45 days ago"
        ]}
        onPromise={() => console.log('Promised')}
        onMaybe={() => console.log('Maybe')}
        onDismiss={() => console.log('Dismissed')}
      />
      <SuggestionCard
        contactName="Michael Park"
        score={2}
        reasons={[
          "DevTools investor at Series A",
          "Strong relationship (0.8 score)",
        ]}
        onPromise={() => console.log('Promised')}
        onMaybe={() => console.log('Maybe')}
        onDismiss={() => console.log('Dismissed')}
      />
    </div>
  );
}
