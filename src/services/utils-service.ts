import Gio from '@girs/gio-2.0';
import GLib from '@girs/glib-2.0';
import { Application } from '../interfaces/application';
import { LoggerService } from './logger-service';

export class UtilsService {
  static _instance: UtilsService;
  private logger = LoggerService.instance;

  public static get instance(): UtilsService {
    if (!UtilsService._instance) {
      UtilsService._instance = new UtilsService();
    }

    return UtilsService._instance;
  }

  public isDevelopmentMode(): boolean {
    // Verificar variable de entorno NODE_ENV
    const nodeEnv = GLib.getenv('NODE_ENV');
    return nodeEnv === 'development';
  }

  public executeCommand(command: string, args: string[] = []): [string, string] {
    try {
      const process = new Gio.Subprocess({
        argv: [command, ...args],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });

      process.init(null);

      const [ok, stdout, stderr] = process.communicate_utf8(null, null);
      if (ok) {
        return [stdout, stderr];
      } else {
        throw new Error('Failed to execute command');
      }
    } catch (error) {
      throw error;
    }
  }

  public isApplicationInstalled(application: Application): boolean {
    try {
      // console.log('Checking installation status for:', application.packageName);

      const [stdout, stderr] = this.executeCommand(
        application.packageType === 'FLATPAK' ? 'flatpak' : 'apt',
        application.packageType === 'FLATPAK' ? ['info', application.packageName] : ['show', application.packageName]
      );

      return stdout.trim().length > 0;
    } catch (error: any) {
      this.logger.error('Error checking installation status', { package: application.packageName, error: String(error) });
      throw error;
    }
  }
}
