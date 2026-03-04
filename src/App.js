import { useEffect, useState } from "react";
import Categories from "./admin/Categories";

function App() {
  const [data, setData] = useState([]);

  return (
    <div>
      <h1>Supabase Datawiwiwiwwi</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    <Categories />
    </div>
  );

}

export default App;
