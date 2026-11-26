import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublisher, createSubscriber, resetMemoryBus } from '../src/index.js';

const event = { id: 'e-1', type: 'offer.created', membreId: 'm-1', payload: { categorie: 'bd' } };

afterEach(() => resetMemoryBus());

describe('validation des options', () => {
  it('refuse un broker inconnu', async () => {
    await expect(createPublisher({ broker: 'zeromq' })).rejects.toThrow(/inconnu/);
  });

  it('exige un groupe pour consommer', async () => {
    await expect(createSubscriber({ broker: 'memory' })).rejects.toThrow(/group/);
  });

  it('signale les brokers pas encore implémentés', async () => {
    await expect(createPublisher({ broker: 'kafka' })).rejects.toThrow(/Lot 4/);
  });
});

describe('adaptateur memory', () => {
  it('livre une copie du message à chaque groupe', async () => {
    const receivedA = vi.fn();
    const receivedB = vi.fn();
    await (await createSubscriber({ broker: 'memory', group: 'a' })).subscribe('offers', receivedA);
    await (await createSubscriber({ broker: 'memory', group: 'b' })).subscribe('offers', receivedB);

    await (await createPublisher({ broker: 'memory' })).publish('offers', event);

    await vi.waitFor(() => {
      expect(receivedA).toHaveBeenCalledWith(event);
      expect(receivedB).toHaveBeenCalledWith(event);
    });
  });

  it('partage les messages entre consommateurs d’un même groupe', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await (await createSubscriber({ broker: 'memory', group: 'g' })).subscribe('offers', first);
    await (await createSubscriber({ broker: 'memory', group: 'g' })).subscribe('offers', second);
    const publisher = await createPublisher({ broker: 'memory' });

    await publisher.publish('offers', { ...event, id: 'e-1' });
    await publisher.publish('offers', { ...event, id: 'e-2' });

    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  it('redistribue un message dont le traitement échoue', async () => {
    let attempts = 0;
    const handler = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('échec simulé');
    });
    await (await createSubscriber({ broker: 'memory', group: 'g' })).subscribe('offers', handler);

    await (await createPublisher({ broker: 'memory' })).publish('offers', event);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(3));
  });

  it('ne livre plus rien après close()', async () => {
    const handler = vi.fn();
    const subscriber = await createSubscriber({ broker: 'memory', group: 'g' });
    await subscriber.subscribe('offers', handler);
    await subscriber.close();

    await (await createPublisher({ broker: 'memory' })).publish('offers', event);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(handler).not.toHaveBeenCalled();
  });
});
