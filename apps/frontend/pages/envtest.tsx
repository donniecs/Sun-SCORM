console.log('Environment variables at build time:');
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('API_GATEWAY_URL:', process.env.API_GATEWAY_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

export default function EnvTest() {
  return (
    <div>
      <h1>Environment Test</h1>
      <p>NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL}</p>
      <p>Check console for server-side values</p>
    </div>
  );
}
