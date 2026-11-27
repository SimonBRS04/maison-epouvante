import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublisher, createSubscriber, resetMemoryBus } from '../src/index.js';

const event = { id: 'e-1', type: 'offer.created', membreId: 'm-1', payload: { categorie: 'bd' } };

afterEach(() => resetMemoryBus());

describe('option validation', () => {
  it('rejects an unknown broker', async () => {
    await expect(createPublisher({ broker: 'zeromq' })).rejects.toThrow(/Unknown BROKER/);
  });

  it('requires a group to consume', async () => {
    await expect(createSubscriber({ broker: 'memory' })).rejects.toThrow(/group/);
  });
});

describe('memory adapter', () => {
  it('delivers a copy of the message to each group', async () => {
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

  it('shares messages between consumers of the same group', async () => {
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

  it('redelivers a message whose handler fails', async () => {
    let attempts = 0;
    const handler = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('simulated failure');
    });
    await (await createSubscriber({ broker: 'memory', group: 'g' })).subscribe('offers', handler);

    await (await createPublisher({ broker: 'memory' })).publish('offers', event);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(3));
  });

  it('delivers nothing after close()', async () => {
    const handler = vi.fn();
    const subscriber = await createSubscriber({ broker: 'memory', group: 'g' });
    await subscriber.subscribe('offers', handler);
    await subscriber.close();

    await (await createPublisher({ broker: 'memory' })).publish('offers', event);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(handler).not.toHaveBeenCalled();
  });
});
