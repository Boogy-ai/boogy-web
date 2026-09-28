// The script the platform's install page loads. Nothing else runs there.
import { installFoundation } from '../layout/install';
import { bootInstallConsent } from './install';

installFoundation();
bootInstallConsent();
