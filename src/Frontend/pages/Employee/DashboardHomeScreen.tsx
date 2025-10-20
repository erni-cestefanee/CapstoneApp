// JSX automatic runtime - no need to import React directly

import './DashboardHomeScreen.css';
import '../../components/styles/AvailableLeaves.css';

import AvailableLeaves from '../../components/AvailableLeaves';
import ButtonRequest from '../../components/ButtonRequest';
import EmployeeTeams from '../../components/EmployeeTeams';
import JoinTeam from '../../components/JoinTeam';
import QuickStats from '../../components/QuickStats';
import UpcomingLeaves from '../../components/UpcomingLeaves';

export default function DashboardHome() {
	return (
			<div className="dashboard-home page-grid">
				<main className="center-column">
					<div className="content-inner">
						<div className="main-left">
							<AvailableLeaves />
							<UpcomingLeaves />
						</div>

						<div className="inline-right">
							<ButtonRequest />
							<QuickStats />
							<EmployeeTeams />
							<JoinTeam />
						</div>
					</div>
				</main>
			</div>
	);
}
