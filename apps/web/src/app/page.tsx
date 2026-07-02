export default async function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Milestone 1</h1>
      <p>Frontend is running.</p>

      <ul>
        <li>Web: http://localhost:3000</li>
        <li>API: http://localhost:4000/health</li>
        <li>Model server: http://localhost:8000/health</li>
      </ul>
    </main>
  );
}
