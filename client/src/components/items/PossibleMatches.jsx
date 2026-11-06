import { TrendingUp, MapPin, CalendarDays } from 'lucide-react';

export default function PossibleMatches({ matches = [] }) {
  if (!matches.length) {
    return (
      <div className="panel">
        <h3>Possible Matches</h3>
        <p className="muted">No likely matches have been identified yet.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h3>Possible Matches</h3>
      </div>

      <div className="match-list">
        {matches.map((match) => (
          <div key={match._id} className="match-item">
            <img src={match.image} alt={match.title} className="match-image" />
            <div className="match-content">
              <div className="match-score-wrap">
                <span className="score-pill">{match.score}% Match</span>
              </div>
              <h4>{match.title}</h4>
              <p className="muted">{match.category}</p>
              <div className="meta-row small-meta">
                <span><MapPin size={14} /> {match.location}</span>
                <span><CalendarDays size={14} /> {match.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
