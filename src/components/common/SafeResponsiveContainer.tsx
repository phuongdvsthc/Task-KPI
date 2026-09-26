import React, { useState, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';

export const SafeResponsiveContainer: React.FC<any> = (props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: props.width || '100%', height: props.height || 300 }} />;
  }

  return <ResponsiveContainer {...props} />;
};
