import { Router } from 'express';

export function notificationsRouter({ store, auth }) {
  const router = Router();

  // Un membre voit ses notifications ; un modérateur voit tout, filtrable par ?membreId=.
  router.get('/', auth.requireRole('membre'), (req, res) => {
    const isModerator = req.user.roles.includes('moderateur');
    const membreId = isModerator ? req.query.membreId : req.user.id;
    res.json(store.list({ membreId }));
  });

  return router;
}
