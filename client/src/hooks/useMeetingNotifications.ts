import { useEffect, useRef } from 'react';
import { useTodaysEvents } from './useUpcomingEvents';
import { differenceInSeconds } from 'date-fns';
import { useToast } from './use-toast';

export function useMeetingNotifications() {
  const { data: events } = useTodaysEvents();
  const { toast } = useToast();
  const notifiedEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    const checkUpcomingMeetings = () => {
      const now = new Date();
      
      events.forEach(event => {
        // Skip if already notified for this event
        if (notifiedEventIds.current.has(event.id)) return;
        
        const secondsUntil = differenceInSeconds(event.startTime, now);
        
        // Show notification when between 30 and 90 seconds before meeting (ensures one notification)
        if (secondsUntil >= 30 && secondsUntil <= 90) {
          // Mark as notified to prevent duplicates
          notifiedEventIds.current.add(event.id);
          
          // Check if browser supports notifications
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Meeting Starting Soon', {
              body: `${event.title} starts in 1 minute`,
              icon: '/favicon.ico',
              tag: event.id,
            });
          }
          
          // Also show toast notification
          toast({
            title: 'Meeting Starting Soon',
            description: `${event.title} starts in 1 minute`,
            duration: 10000,
          });
        }
      });
      
      // Clean up notified events that have already passed
      const expiredEventIds = Array.from(notifiedEventIds.current).filter(id => {
        const event = events.find(e => e.id === id);
        if (!event) return true;
        return differenceInSeconds(event.startTime, now) < -300; // Remove 5 minutes after start
      });
      
      expiredEventIds.forEach(id => notifiedEventIds.current.delete(id));
    };

    // Check every 15 seconds for upcoming meetings
    const interval = setInterval(checkUpcomingMeetings, 15000);
    
    // Check immediately
    checkUpcomingMeetings();

    return () => clearInterval(interval);
  }, [events, toast]);

  // Request notification permission if not granted
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
}
