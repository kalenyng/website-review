import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const rules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowedStatus(status) {
      return status in ['open', 'resolved'];
    }

    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.resource.data.status in ['open', 'resolved'];
      allow update: if request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'updatedAt']) &&
        isAllowedStatus(request.resource.data.status);
      allow delete: if false;
    }
  }
}
`;

describe.skip('firestore rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'website-review-rules-test',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('allows valid status transitions and rejects invalid ones', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(db, 'comments', 'one'), {
        status: 'open',
        updatedAt: new Date(),
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'comments', 'one'), { status: 'resolved', updatedAt: new Date() }));
    await assertFails(updateDoc(doc(db, 'comments', 'one'), { status: 'bad', updatedAt: new Date() }));
  });
});
