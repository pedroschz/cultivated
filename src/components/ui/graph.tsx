"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GraphProps {
  func: (x: number) => number;
  domain: [number, number];
  range: [number, number];
}

const Graph: React.FC<GraphProps> = ({ func, domain, range }) => {
  const data = [];
  for (let x = domain[0]; x <= domain[1]; x += 0.5) {
    data.push({ x, y: func(x) });
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" domain={domain} />
        <YAxis type="number" domain={range} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="y" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Graph;