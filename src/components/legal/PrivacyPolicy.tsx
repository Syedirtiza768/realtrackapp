import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm mb-8 inline-block">
          &larr; Back to app
        </Link>
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: June 22, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
          <p className="mb-3">
            We collect information necessary to provide our vehicle listing and eBay integration services:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-slate-200">Account information</strong> — name, email address, and password (hashed) when you register.</li>
            <li><strong className="text-slate-200">eBay account data</strong> — OAuth tokens, eBay user ID, store information, listings, orders, and business policies when you connect your eBay account.</li>
            <li><strong className="text-slate-200">Vehicle inventory data</strong> — VINs, vehicle details, images, pricing, and fitment information you upload or import.</li>
            <li><strong className="text-slate-200">Usage data</strong> — API call logs, sync history, and audit trails for service operation and troubleshooting.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To create, manage, and sync vehicle listings to your eBay store(s).</li>
            <li>To process and fulfill orders placed through eBay.</li>
            <li>To improve our platform and develop new features.</li>
            <li>To provide customer support and troubleshoot issues.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">3. Third-Party Services</h2>
          <p className="mb-3">We integrate with the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-slate-200">eBay</strong> — For listing management, order processing, and account authentication via OAuth.</li>
            <li><strong className="text-slate-200">OpenRouter / AI providers</strong> — For AI-assisted content generation (listing descriptions, enrichment).</li>
            <li><strong className="text-slate-200">Amazon Web Services (AWS) S3</strong> — For image and file storage.</li>
            <li><strong className="text-slate-200">Redis</strong> — For session state and job queue management.</li>
            <li><strong className="text-slate-200">PostgreSQL</strong> — For primary data storage.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
          <p>
            We use industry-standard encryption (AES-256-GCM) for sensitive data including eBay OAuth tokens.
            All API traffic is encrypted via TLS. Access to production data is restricted to authorized
            personnel only. Despite these measures, no method of electronic storage is 100% secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. Upon account deletion, we
            remove your personal information and disconnect associated eBay accounts within 30 days.
            Audit logs may be retained longer for compliance purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
          <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Withdraw consent for data processing (e.g., disconnect eBay accounts).</li>
            <li>Export your data in a portable format.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:privacy@realtrackapp.com" className="text-blue-400 hover:text-blue-300">
              privacy@realtrackapp.com
            </a>.
          </p>
        </section>

        <div className="border-t border-slate-700 pt-6 text-sm text-slate-500">
          <p>
            RealTrack App —{' '}
            <a href="https://mhn.realtrackapp.com" className="text-blue-400 hover:text-blue-300">
              mhn.realtrackapp.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
