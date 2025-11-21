/**
 * Browser Push Notification utilities
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        ...options,
      });

      // Auto-close notification after 6 seconds
      setTimeout(() => notification.close(), 6000);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}

export function notifyTranscriptReady(conversationTitle: string) {
  sendNotification('Transcript Ready', {
    body: `Your recording "${conversationTitle}" has been transcribed and analyzed.`,
    tag: 'transcript-ready',
    requireInteraction: false,
  });
}

export function notifyMatchesReady(conversationTitle: string, matchCount: number) {
  const plural = matchCount === 1 ? 'match' : 'matches';
  sendNotification('Matches Found!', {
    body: `We found ${matchCount} potential ${plural} for "${conversationTitle}". Time to start introducing!`,
    tag: 'matches-ready',
    requireInteraction: false,
  });
}

export function notifyProcessingComplete(conversationTitle: string, matchCount: number) {
  const plural = matchCount === 1 ? 'match' : 'matches';
  sendNotification('Processing Complete', {
    body: `${conversationTitle}: ${matchCount} ${plural} ready. Ready to make introductions?`,
    tag: 'processing-complete',
    requireInteraction: false,
  });
}
