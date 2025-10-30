import ConversationHistoryRow from '../ConversationHistoryRow';

export default function ConversationHistoryRowExample() {
  return (
    <div className="p-6">
      <table className="w-full">
        <thead className="border-b border-border">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-semibold">Date</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Participants</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Duration</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Intros</th>
            <th className="py-3 px-4 text-right text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          <ConversationHistoryRow
            id="1"
            startedAt={new Date(Date.now() - 86400000).toISOString()}
            endedAt={new Date(Date.now() - 84600000).toISOString()}
            participants={["Alex Chen", "Jordan Smith"]}
            suggestionsCount={3}
            onView={() => console.log('View')}
            onDelete={() => console.log('Delete')}
          />
          <ConversationHistoryRow
            id="2"
            startedAt={new Date(Date.now() - 172800000).toISOString()}
            endedAt={new Date(Date.now() - 170400000).toISOString()}
            participants={["Sarah Lee", "Michael Park", "Emma Wilson"]}
            suggestionsCount={5}
            onView={() => console.log('View')}
            onDelete={() => console.log('Delete')}
          />
        </tbody>
      </table>
    </div>
  );
}
