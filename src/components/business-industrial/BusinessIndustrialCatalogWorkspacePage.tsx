import CatalogWorkspace from '../catalog/shared/CatalogWorkspace';
import { CATALOG_CONFIGS } from '../catalog/shared/catalogConfig';

export default function BusinessIndustrialCatalogWorkspacePage() {
  return <CatalogWorkspace config={CATALOG_CONFIGS.business_industrial} />;
}
