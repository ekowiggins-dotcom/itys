import {test} from 'node:test';import assert from 'node:assert/strict';
import {emojiFile,emojiAsset} from '../lib/emoji';
test('share cards draw emoji from the bundled Twemoji set',async()=>{
 assert.equal(emojiFile('🫣'),'1fae3');assert.equal(emojiFile('❤️'),'2764');assert.equal(emojiFile('🍻'),'1f37b');
 assert.equal(emojiFile('🧑‍💻'),'1f9d1-200d-1f4bb');
 assert.match(await emojiAsset('🫣'),/^data:image\/svg\+xml;base64,/);
 assert.equal(await emojiAsset('\u{10FFFF}'),'');
});
