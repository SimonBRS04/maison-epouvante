import { describe, expect, it } from 'vitest';
import { createNotifier } from '../src/notifier.js';
import { createNotificationStore } from '../src/store.js';

const interests = { 'm-001': ['figurines'], 'm-002': ['figurines', 'bd'], 'm-003': ['bd'] };
const event = {
  id: 'evt-1',
  type: 'offer.created',
  envoyeA: '2026-12-01T14:30:00.000Z',
  membreId: 'm-001',
  payload: { offerId: 'o-0010', titre: 'Figurine', type: 'don', categorie: 'figurines' },
};

describe('createNotifier', () => {
  it('prévient les membres intéressés, sauf l’auteur de l’offre', () => {
    const store = createNotificationStore();
    const created = createNotifier({ store, interests }).handle(event);
    expect(created.map((n) => n.membreId)).toEqual(['m-002']);
    expect(created[0]).toMatchObject({ offerId: 'o-0010', categorie: 'figurines', lue: false });
  });

  it('ignore un événement déjà traité (idempotence)', () => {
    const store = createNotificationStore();
    const notifier = createNotifier({ store, interests });
    notifier.handle(event);
    expect(notifier.handle(event)).toEqual([]);
    expect(store.list()).toHaveLength(1);
  });

  it('ignore les autres types d’événements', () => {
    const store = createNotificationStore();
    expect(
      createNotifier({ store, interests }).handle({ ...event, type: 'offer.deleted' }),
    ).toEqual([]);
  });
});
