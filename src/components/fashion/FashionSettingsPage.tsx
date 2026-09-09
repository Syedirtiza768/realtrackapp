import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function FashionSettingsPage() {
  const { permissions, user } = useAuth();
  const canManage = permissions.includes('fashion.access') && permissions.includes('fashion.settings.manage');
  if (!canManage) return <p role="alert">You do not have permission to manage Fashion settings.</p>;
  const destinations = [
    { to: '/fashion/stores', title: 'Seller connections and policies', description: 'Choose an eBay environment and marketplace, inspect account defaults, and sync business policies.', permission: 'fashion.stores.view' },
    { to: '/fashion/users', title: 'Users, roles and store access', description: 'Create Fashion accounts, assign roles and stores, or deactivate access.', permission: 'fashion.users.manage' },
    { to: '/fashion/review', title: 'Authenticity review', description: 'Inspect private evidence and record an explicit approval or rejection.', permission: 'fashion.authenticity.review' },
    { to: '/fashion/incidents', title: 'Quarantine incidents', description: 'Apply a local quarantine and inspect private compliance records.', permission: 'fashion.incidents.manage' },
  ];
  return <div><h1 className="text-3xl font-semibold">Fashion settings</h1><p className="mt-2 text-slate-500">Workspace administration and the rules that govern Fashion listings.</p>
    <section className="my-6 rounded-xl bg-white p-5 dark:bg-slate-900"><h2 className="font-semibold">Your access</h2><p className="mt-2 text-sm">{user?.name || user?.email} · {user?.roleName || 'Fashion administrator'}</p><p className="mt-1 text-sm text-slate-500">Available actions follow your current session permissions and server-authorized store access.</p></section>
    <div className="grid gap-4 sm:grid-cols-2">{destinations.filter((item) => permissions.includes(item.permission) && (item.to !== '/fashion/review' || permissions.includes('fashion.listings.view'))).map((item) => <Link key={item.to} to={item.to} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-pink-400 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-sm text-slate-500">{item.description}</p><span className="mt-3 inline-block text-sm font-medium text-pink-700 dark:text-pink-400">Open settings →</span></Link>)}</div>
    <section className="mt-6 rounded-xl bg-white p-5 dark:bg-slate-900"><h2 className="font-semibold">Enforced workspace rules</h2><dl className="mt-4 space-y-4 text-sm">
      <div><dt className="font-medium">Dedicated Fashion stores</dt><dd className="mt-1 text-slate-500">Seller connections belong to this vertical. Conversion to another vertical and shared seller ownership are not available.</dd></div>
      <div><dt className="font-medium">Explicit authenticity approval</dt><dd className="mt-1 text-slate-500">The reviewer must inspect the listing and evidence, then confirm authenticity. Material listing changes require another review. Automated checks do not authenticate a physical item.</dd></div>
      <div><dt className="font-medium">Private evidence</dt><dd className="mt-1 text-slate-500">Evidence references and review notes are accessible only through authorized compliance views. They are not public listing content.</dd></div>
      <div><dt className="font-medium">Quarantine remains blocked</dt><dd className="mt-1 text-slate-500">A quarantined item cannot be approved or edited back into publishing. Remote withdrawal must be checked separately; this workspace does not expose a quarantine release action.</dd></div>
    </dl><p className="mt-5 text-xs text-slate-500">These controls are enforced by the application. There is no workspace override or configuration save action for these rules.</p></section>
  </div>;
}
