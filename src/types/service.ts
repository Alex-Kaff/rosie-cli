import { Input, ContextUpdate } from './index';
import { ExecutionContext } from './executionContext';

export interface Service<ServiceParams> {
    initService?: (params: ServiceParams) => Promise<void>;
    processMessage: (message: Input, context: ExecutionContext) => Promise<ContextUpdate>;
}

