import { describe, expect, it } from 'vitest';
import { createNotifier } from '../src/notifier.js';
import { createMemoryNotificationStore } from '../src/stores/memory.js';

const interests = { 'm-001': ['figurines'], 'm-002': ['figurines', 'bd'], 'm-003': ['bd'] };
const event = {
  id: 'evt-1',
  type: 'offer.created',
  envoyeA: '2026-12-01T14:30:00.000Z',
  membreId: 'm-001',
  payload: { offerId: 'o-0010', titre: 'Figurine', type: 'don', categorie: 'figurines' },
};

describe('createNotifier', () => {
  it('notifies interested members, except the author of the offer', async () => {
    const store = createMemoryNotificationStore();
    const created = await createNotifier({ store, interests }).handle(event);
    expect(created.map((n) => n.membreId)).toEqual(['m-002']);
    expect(created[0]).toMatchObject({ offerId: 'o-0010', categorie: 'figurines', lue: false });
  });

  it('ignores an already processed event (idempotence)', async () => {
    const store = createMemoryNotificationStore();
    const notifier = createNotifier({ store, interests });
    await notifier.handle(event);
    expect(await notifier.handle(event)).toEqual([]);
    expect(await store.list()).toHaveLength(1);
  });

  it('ignores other event types', async () => {
    const store = createMemoryNotificationStore();
    expect(
      await createNotifier({ store, interests }).handle({ ...event, type: 'offer.deleted' }),
    ).toEqual([]);
  });
});
