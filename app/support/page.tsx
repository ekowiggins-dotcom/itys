import LegalPage,{Email} from '../legal-ui/LegalPage';
import {BRAND_NAME} from '../../lib/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Help · '+BRAND_NAME};
export default function Support(){
 return <LegalPage title="Help" lead={`Stuck, found a bug, or want your data? Email us at the address below and a person will reply.`}>
  <h2>Contact</h2><p><Email/></p>
  <h2>How do points work?</h2><p>Nothing to spend. When picks close, each answer gets its points from how the group split: 10 if everyone said the same, up to 40 the fewer friends agreed. Get it right and you score those points. Wrong is 0.</p>
  <h2>I lost my account</h2><p>If you saved it with Apple, tap <b>Sign in with Apple</b> on the start screen, on any phone or browser. If you didn’t, ask a friend in your group to send you the invite link and join again. Email us if you need your old calls moved over.</p>
  <h2>Someone made a call about me I don’t like</h2><p>Open the Group tab → Safety and ask for it to be removed. It’s hidden straight away while the admin looks at it.</p>
  <h2>A football result is wrong</h2><p>Results usually correct themselves within a few hours. If not, email us with the match.</p>
  <h2>Delete my account</h2><p>Group tab → <b>Delete my account</b>. Or email us and we’ll do it.</p>
 </LegalPage>}
