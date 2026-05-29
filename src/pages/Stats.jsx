import { useState, useEffect } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { supabase } from "../supabaseClient";
import { useNotify } from "../context/NotificationContext";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);


function ChartCard({ title, children, loading }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : children}
      </CardContent>
    </Card>
  );
}

export default function Stats() {
  const theme = useTheme();
  const notify = useNotify();

  // Type-pie colors derived from theme so they shift with the user's palette
  const TYPE_COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.primary.dark,
    theme.palette.secondary.dark,
    theme.palette.primary.light,
  ];

  // Status colors — applied/interviewing follow theme; the rest are semantic
  const STATUS_COLORS = {
    applied:      theme.palette.primary.main,
    interviewing: theme.palette.secondary.main,
    offered:      "#2e7d32",
    accepted:     "#1b5e20",
    declined:     "#f59e0b",
    rejected:     "#c62828",
    withdrawn:    "#78909c",
    ghosted:      "#90a4ae",
  };
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState([]);
  const [typeData, setTypeData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [timeRange, setTimeRange] = useState("week"); // 'week' | 'month'

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (!loading) buildTimeline(); }, [timeRange]);

  async function loadAll() {
    setLoading(true);
    try {
      const [apps, positions] = await Promise.all([
        supabase.from("applications").select("status, applied_date"),
        supabase.from("positions").select("type"),
      ]);
      if (apps.error) throw apps.error;
      if (positions.error) throw positions.error;

      buildStatusChart(apps.data);
      buildTypeChart(positions.data);
      buildFunnel(apps.data);
      buildTimelineData(apps.data, timeRange);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function buildStatusChart(apps) {
    const counts = {};
    apps.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    setStatusData(Object.entries(counts).map(([name, value]) => ({ name, value })));
  }

  function buildTypeChart(positions) {
    const counts = {};
    positions.forEach((p) => {
      if (p.type) counts[p.type] = (counts[p.type] ?? 0) + 1;
    });
    const labels = {
      full_time: "Full Time", part_time: "Part Time", contract: "Contract",
      internship: "Internship", temporary: "Temporary",
    };
    setTypeData(Object.entries(counts).map(([k, v]) => ({ name: labels[k] ?? k, value: v })));
  }

  function buildFunnel(apps) {
    const applied = apps.length;
    const interviewing = apps.filter((a) => ["interviewing", "offered", "accepted", "declined"].includes(a.status)).length;
    const offered = apps.filter((a) => ["offered", "accepted", "declined"].includes(a.status)).length;
    const accepted = apps.filter((a) => a.status === "accepted").length;
    const pct = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
    setFunnelData([
      { stage: "Applied", count: applied, rate: "100%" },
      { stage: "Interviewing", count: interviewing, rate: pct(interviewing, applied) },
      { stage: "Offered", count: offered, rate: pct(offered, interviewing) },
      { stage: "Accepted", count: accepted, rate: pct(accepted, offered) },
    ]);
  }

  function buildTimelineData(apps, range) {
    const grouped = {};
    apps.forEach((a) => {
      if (!a.applied_date) return;
      const d = dayjs(a.applied_date);
      const key = range === "week"
        ? `${d.year()}-W${String(d.isoWeek()).padStart(2, "0")}`
        : `${d.year()}-${String(d.month() + 1).padStart(2, "0")}`;
      grouped[key] = (grouped[key] ?? 0) + 1;
    });
    const sorted = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([period, count]) => ({ period, count }));
    setTimelineData(sorted);
  }

  function buildTimeline() {
    supabase.from("applications").select("applied_date").then(({ data }) => {
      if (data) buildTimelineData(data, timeRange);
    });
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>Job Stats 📊</Typography>

      <Grid container spacing={3}>
        {/* Status donut */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Application Status Breakdown" loading={loading}>
            {statusData.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>No applications yet!</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#90a4ae"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        {/* Job type pie */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Position Types" loading={loading}>
            {typeData.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>No positions yet!</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                    {typeData.map((entry, i) => (
                      <Cell key={entry.name} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        {/* Funnel */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Application Funnel" loading={loading}>
            {funnelData.every((f) => f.count === 0) ? (
              <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>No data yet!</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="rate" position="right" style={{ fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        {/* Over time */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Applications Over Time" loading={loading}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
              <ButtonGroup size="small">
                <Button variant={timeRange === "week" ? "contained" : "outlined"} onClick={() => setTimeRange("week")}>Week</Button>
                <Button variant={timeRange === "month" ? "contained" : "outlined"} onClick={() => setTimeRange("month")}>Month</Button>
              </ButtonGroup>
            </Box>
            {timelineData.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>No data yet!</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} name="Applications" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
