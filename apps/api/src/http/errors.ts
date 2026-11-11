export type FieldError = { path: string; message: string };

export class AppError extends Error {
  readonly status: number;
  readonly title: string;
  readonly errors: FieldError[] | undefined;

  constructor(status: number, title: string, detail?: string, errors?: FieldError[]) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[]) {
    super(400, 'Dados inválidos', 'Um ou mais campos são inválidos.', errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'Não autenticado', 'Faça login para continuar.');
  }
}

export class ForbiddenError extends AppError {
  constructor(detail: string) {
    super(403, 'Acesso negado', detail);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'Não encontrado', `${resource} não encontrado(a).`);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, 'Conflito', detail);
  }
}

export class UnprocessableError extends AppError {
  constructor(detail: string) {
    super(422, 'Regra de negócio violada', detail);
  }
}
