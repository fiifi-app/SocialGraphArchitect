import ConsentBanner from '../ConsentBanner';

export default function ConsentBannerExample() {
  return (
    <ConsentBanner
      onAccept={() => console.log('Accepted')}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
