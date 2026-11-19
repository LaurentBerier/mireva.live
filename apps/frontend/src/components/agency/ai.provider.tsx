'use client';
import React, { ReactNode } from 'react';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotReadable,
} from '@copilotkit/react-core';

export function OptionalCopilot({
  children,
  runtimeUrl,
}: {
  children: ReactNode;
  runtimeUrl: string;
}) {
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true' ? (
    <CopilotKit
      credentials="include"
      runtimeUrl={runtimeUrl}
      useSingleEndpoint
      showDevConsole={false}
    >
      {children}
    </CopilotKit>
  ) : (
    <>{children}</>
  );
}

function EnabledCopilotActions({
  readable,
  action,
  dependencies,
}: {
  readable: Parameters<typeof useCopilotReadable>[0];
  action: {
    name: string;
    description: string;
    parameters: {
      name: string;
      type: 'string[]';
      description: string;
      required?: boolean;
    }[];
    handler: (args: any) => any;
  };
  dependencies?: Parameters<typeof useCopilotAction>[1];
}): null {
  useCopilotReadable(readable);
  useCopilotAction(action, dependencies);
  return null;
}
export function OptionalCopilotActions(
  props: React.ComponentProps<typeof EnabledCopilotActions>
) {
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true' ? (
    <EnabledCopilotActions {...props} />
  ) : null;
}
