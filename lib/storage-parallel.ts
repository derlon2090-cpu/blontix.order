// Wait for every task before reporting failure: cleanup must never race an upload.
export async function settleStorageTasks<T>(tasks:(()=>Promise<T>)[]):Promise<T[]>{
  const results=await Promise.allSettled(tasks.map(task=>Promise.resolve().then(task)));
  const failure=results.find(result=>result.status==='rejected');
  if(failure?.status==='rejected')throw failure.reason;
  return results.map(result=>{
    if(result.status==='fulfilled')return result.value;
    throw new Error('Storage task failed');
  });
}
