# Base de données

## Prisma
- Modèles: User, Stream, StreamMetric, FollowerEvent, ClipMoment, ChatMetric, CreatedClip, ScheduleEntry, Goal, Annotation, NotificationWebhook…

## Migrations
- `npm run prisma:migrate`

## Rétention
- Job quotidien supprimant les StreamMetric âgés de > 180 jours.
