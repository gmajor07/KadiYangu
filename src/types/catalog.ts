export type CatalogFormState = {
  message: string;
  errors?: Record<string, string[] | undefined>;
  values?: Record<string, string | boolean>;
};
