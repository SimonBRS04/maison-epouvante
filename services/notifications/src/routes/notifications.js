import { Router } from 'express';

export function notificationsRouter({ store, auth }) {
  const router = Router();

  // A member sees their own notifications; a moderator sees everything, filterable by ?membreId=.
  router.get('/', auth.requireRole('membre'), (req, res) => {
    const isModerator = req.user.roles.includes('moderateur');
    const membreId = isModerator ? req.query.membreId : req.user.id;
    res.json(store.list({ membreId }));
  });

  return router;
}
