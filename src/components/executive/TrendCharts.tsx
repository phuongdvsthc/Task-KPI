import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dashboardApiClient } from '../../services/dashboardApiClient';

export const TrendCharts: React.FC<{ filters: any }> = ({ filters }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await dashboardApiClient.getExecutiveTrends(filters, controller.signal);
        setData(result);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error(e);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      controller.abort();
    };
  }, [filters]);

  if (loading) return <div>Đang tải biểu đồ...</div>;
  if (!data) return <div>Lỗi tải dữ liệu.</div>;

  return (
    <div className="space-y-8">
      <div className="h-64">
        <h3 className="font-semibold mb-2">Xu hướng công việc</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series.tasks}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket_key" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="tasks_created" stroke="#8884d8" name="Công việc tạo mới" />
            <Line type="monotone" dataKey="tasks_completed" stroke="#82ca9d" name="Công việc hoàn thành" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Add other charts here */}
    </div>
  );
};
