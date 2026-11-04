import LegalPage,{Email,contact} from '../legal-ui/LegalPage';
import {BRAND_NAME} from '../../lib/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Terms · '+BRAND_NAME};
export default function Terms(){const {operator}=contact();
 return <LegalPage title="Terms of use" lead={`The short version: ${BRAND_NAME} is a free game between friends. No money, no prizes, be decent.`}>
  <h2>The game</h2><ul>
   <li>{BRAND_NAME} is free. You need to be 18 or over to use it.</li>
   <li>Points are only for bragging rights. They have no money value and can’t be bought, sold, given, swapped or cashed out. There are no prizes.</li>
   <li>Don’t use {BRAND_NAME} to play for money or anything of value, in or outside the app. We remove groups that do.</li>
  </ul>
  <h2>What you post</h2><ul>
   <li>You’re responsible for the calls you make and the names you use.</li>
   <li>No harassment, hate, threats, sexual content, or private information about people. Calls about friends should be the kind they’d laugh at too.</li>
   <li>Anyone can report a call, and the person a call is about can ask for it to be removed. Group admins can remove calls and members can block each other. We can remove content or accounts that break these rules.</li>
  </ul>
  <h2>Results</h2><p>Football results come from a data provider and can be late or corrected. Results of your own calls are set by the group, with a chance to dispute them. We may correct results and points when something has gone wrong.</p>
  <h2>The service</h2><p>We work to keep {BRAND_NAME} running, but it’s provided as it is, and features can change. As far as the law allows, we aren’t liable for losses caused by using it. Nothing here limits rights you have by law as a consumer.</p>
  <h2>Ending</h2><p>You can delete your account at any time from the Group tab. We may suspend accounts that break these terms.</p>
  <h2>Who we are</h2><p>{BRAND_NAME} is run by {operator}. These terms are governed by the laws of Türkiye. Contact: <Email/>.</p>
 </LegalPage>}
