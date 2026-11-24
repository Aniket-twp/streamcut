import { navigate } from '../lib/router';
import type { SchedulePost } from '../types';
import { EmptyState, SectionHead } from './ui';

export default function AnalyticsScreen({ schedules }: { schedules: SchedulePost[] }) {
  const published = schedules.filter((schedule) => schedule.status === 'published');

  return (
    <div className="page">
      <section className="panel-card analytics-intro">
        <div>
          <h2>Connect an account to see performance</h2>
          <p>
            Views, watch time, follows and top clips come from platform APIs. This build has no publishing OAuth apps
            configured, so there is no analytics data to show — nothing is simulated here.
          </p>
          <button className="btn btn-lime" onClick={() => navigate('/connections')}>
            Open connections
          </button>
        </div>
      </section>

      <section className="panel-block">
        <SectionHead
          title="Manual publishing activity"
          sub="Only actions recorded in this workspace — not platform metrics."
        />
        {published.length === 0 ? (
          <EmptyState title="No posts marked published">
            When you mark a post as published in the Publisher, it is counted here. Real view and engagement metrics need
            a connected platform API.
          </EmptyState>
        ) : (
          <div className="stack-list">
            {published.map((schedule) => (
              <div className="list-row" key={schedule.id}>
                <span className="list-row-main">
                  <b>{schedule.title}</b>
                  <span>{schedule.destinations.join(', ')}</span>
                </span>
                <span className="muted-small">{schedule.when ? new Date(schedule.when).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
