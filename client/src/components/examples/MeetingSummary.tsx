import MeetingSummary from '../MeetingSummary';

export default function MeetingSummaryExample() {
  return (
    <div className="max-w-3xl p-6">
      <MeetingSummary
        highlights={[
          "Team is raising $2M seed round for AI infrastructure platform",
          "Current traction: 500 developers, 20% MoM growth",
          "Geographic focus: Bay Area and New York",
          "Looking for investors with DevTools experience"
        ]}
        decisions={[
          "Follow up with Sarah Johnson about seed investment intro",
          "Share deck with Michael Park by end of week",
          "Schedule follow-up call for next Tuesday"
        ]}
        actions={[
          "Send updated pitch deck to Alex by Friday",
          "Prepare investor questions document",
          "Research comparable DevTools valuations",
          "Set up intro call with potential LP contact"
        ]}
      />
    </div>
  );
}
