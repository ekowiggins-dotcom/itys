// Privacy, terms and help: plain pages on the server (not bundled in the app; the app links to them).
import {BRAND,BRAND_NAME} from '../../lib/brand';
export const UPDATED='4 November 2026';
export function contact(){return{email:process.env.SUPPORT_EMAIL||'',operator:process.env.OPERATOR_NAME||'the '+BRAND_NAME+' team'}}
export function Email(){const {email}=contact();return email?<a href={'mailto:'+email}>{email}</a>:<span>our support address (coming soon)</span>}
export default function LegalPage({title,lead,children}:{title:string;lead:string;children:React.ReactNode}){
 return <main className="c-legal">
  <a className="c-brandmark" href="/">{BRAND}</a>
  <h1>{title}</h1><p className="c-legal-lead">{lead}</p>
  {children}
  <nav className="c-legal-nav"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Help</a></nav>
  <p className="c-legal-date">Last updated {UPDATED}</p>
 </main>;
}
