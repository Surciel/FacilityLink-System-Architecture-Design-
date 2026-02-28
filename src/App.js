import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      let { data: rows, error } = await supabase.from("my_table").select("*");
      if (error) console.error(error);
      else setData(rows);
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1>Supabase Data</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default App;
