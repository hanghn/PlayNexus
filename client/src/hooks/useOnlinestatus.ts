import useLoginContext from "./useLoginContext.ts";

export default function useOnlineStatus() {
  const { onlineUsers } = useLoginContext();
  return { onlineUsers };
}
