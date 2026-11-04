import LegalPage,{Email,contact} from '../legal-ui/LegalPage';
import {BRAND_NAME} from '../../lib/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Privacy · '+BRAND_NAME};
export default function Privacy(){const {operator}=contact();
 return <LegalPage title="Privacy" lead={`${BRAND_NAME} is a free prediction game for friend groups. We keep as little about you as the game needs, and we never sell it.`}>
  <h2>Who runs {BRAND_NAME}</h2><p>{BRAND_NAME} is run by {operator}. Questions about your data: <Email/>.</p>
  <h2>What we keep</h2><ul>
   <li><b>The name you type</b> when you join a group. It doesn’t have to be your real name.</li>
   <li><b>Your groups and your calls:</b> the calls you make, your picks, your points, level and badges.</li>
   <li><b>Sign in with Apple</b>, if you use it: an anonymous ID from Apple so you can get back into your account. We don’t ask Apple for your name or email.</li>
   <li><b>Notifications</b>, if you turn them on in the app: a device token from Apple so we can send pushes, and which pushes you’ve chosen.</li>
   <li><b>A sign-in token</b> stored as a cookie in your browser or on your phone, so the app knows it’s you.</li>
   <li><b>Reports and blocks</b> you make, so admins can act on them.</li>
   <li><b>Server logs</b> (IP address, time, request) kept by our host for a short time for security and to fix problems.</li>
  </ul>
  <h2>What we don’t do</h2><ul>
   <li>No ads, no ad tracking, no tracking across other apps or websites.</li>
   <li>No selling or renting your data.</li>
   <li>No payments: {BRAND_NAME} never asks for card or bank details.</li>
   <li>No access to your contacts, photos or location.</li>
  </ul>
  <h2>Who sees what</h2><ul>
   <li>People in your group see your name, your points, and your picks once picks close. Before that, they only see how the group is split, without names.</li>
   <li>A call about you is hidden from you until it’s settled.</li>
   <li>Links you share show the call and how many friends are in, never who picked what.</li>
  </ul>
  <h2>Services we use</h2><ul>
   <li><b>Railway</b> hosts the app and its database.</li>
   <li><b>Apple</b> for Sign in with Apple and push notifications.</li>
   <li><b>Google Fonts</b> serves the app’s fonts on the web, so Google sees your IP address when a page loads.</li>
   <li>Football fixtures and results come from a sports data provider. None of your data is sent to it.</li>
  </ul>
  <h2>How long we keep it</h2><p>Until you delete your account. To delete it: <b>Group tab → Delete my account</b>, or email us. Your name is replaced with “Deleted player”, and your sign-in, devices, notifications and Apple link are removed. Picks that had already closed stay, without your name, so your friends’ past results don’t change.</p>
  <h2>Your rights</h2><p>You can ask to see, correct or delete your data at any time, under Türkiye’s data protection law (KVKK) and, where it applies, the EU GDPR. Email <Email/> and we’ll reply within 30 days.</p>
  <h2>Age</h2><p>{BRAND_NAME} is for people aged 18 and over.</p>
  <h2>Changes</h2><p>If this policy changes in a way that matters, we’ll say so in the app.</p>
 </LegalPage>}
