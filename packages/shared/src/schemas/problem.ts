export type ProblemDTO = {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: { path: string; message: string }[];
};
