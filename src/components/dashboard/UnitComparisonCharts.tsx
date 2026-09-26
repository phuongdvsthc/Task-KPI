import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const UnitComparisonCharts: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-8 mt-6">
      <div className="h-64">
        <h3 className="font-semibold mb-2">So sánh công việc hoàn thành</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="organization_unit.name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="tasks.completed_tasks" fill="#82ca9d" name="Công việc hoàn thành" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Add other comparison charts here */}
    </div>
  );
};
