import React, { createContext, useContext } from 'react';

export const BugReplayContext = createContext(null);

export function useBugReplayContext() {
  return useContext(BugReplayContext);
}
