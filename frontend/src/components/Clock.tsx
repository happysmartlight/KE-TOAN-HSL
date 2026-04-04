import { useEffect, useState } from 'react';

export default function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="topbar-clock">
      {time.toLocaleDateString('vi-VN')} {time.toLocaleTimeString('vi-VN')}
      <span className="blink"> _</span>
    </span>
  );
}
