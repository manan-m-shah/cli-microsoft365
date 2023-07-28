import * as assert from 'assert';
import * as sinon from 'sinon';
import { telemetry } from '../../../../telemetry';
import auth from '../../../../Auth';
import { Cli } from '../../../../cli/Cli';
import { CommandInfo } from '../../../../cli/CommandInfo';
import { Logger } from '../../../../cli/Logger';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { pid } from '../../../../utils/pid';
import { session } from '../../../../utils/session';
import { sinonUtil } from '../../../../utils/sinonUtil';
import commands from '../../commands';
const command: Command = require('./folder-add');

describe(commands.FOLDER_ADD, () => {
  let log: any[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;
  let commandInfo: CommandInfo;
  let stubPostResponses: any;

  before(() => {
    sinon.stub(auth, 'restoreAuth').resolves();
    sinon.stub(telemetry, 'trackEvent').returns();
    sinon.stub(pid, 'getProcessName').returns('');
    sinon.stub(session, 'getId').returns('');
    auth.service.connected = true;

    stubPostResponses = (addResp: any = null) => {
      return sinon.stub(request, 'post').callsFake(async (opts) => {
        if ((opts.url as string).indexOf('/_api/web/folders') > -1) {
          if (addResp) {
            throw addResp;
          }
          else {
            return { "Exists": true, "IsWOPIEnabled": false, "ItemCount": 0, "Name": "abc", "ProgID": null, "ServerRelativeUrl": "/sites/test1/Shared Documents/abc", "TimeCreated": "2018-05-02T23:21:45Z", "TimeLastModified": "2018-05-02T23:21:45Z", "UniqueId": "0ac3da45-cacf-4c31-9b38-9ef3697d5a66", "WelcomePage": "" };
          }
        }

        throw 'Invalid request';
      });
    };
    commandInfo = Cli.getCommandInfo(command);
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    loggerLogSpy = sinon.spy(logger, 'log');
  });

  afterEach(() => {
    sinonUtil.restore([
      request.post
    ]);
  });

  after(() => {
    sinon.restore();
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name, commands.FOLDER_ADD);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('should correctly handle folder add reject request', async () => {
    const error = {
      error: {
        'odata.error': {
          code: '-1, Microsoft.SharePoint.Client.InvalidOperationException',
          message: {
            value: 'An error has occurred'
          }
        }
      }
    };
    stubPostResponses(error);

    await assert.rejects(command.action(logger, {
      options: {
        webUrl: 'https://contoso.sharepoint.com',
        parentFolderUrl: '/Shared Documents',
        name: 'abc'
      }
    } as any), new CommandError('An error has occurred'));
  });

  it('should correctly handle folder add success request', async () => {
    stubPostResponses();

    await command.action(logger, {
      options: {
        debug: true,
        webUrl: 'https://contoso.sharepoint.com',
        parentFolderUrl: '/Shared Documents',
        name: 'abc'
      }
    });
    assert(loggerLogSpy.lastCall.calledWith({ "Exists": true, "IsWOPIEnabled": false, "ItemCount": 0, "Name": "abc", "ProgID": null, "ServerRelativeUrl": "/sites/test1/Shared Documents/abc", "TimeCreated": "2018-05-02T23:21:45Z", "TimeLastModified": "2018-05-02T23:21:45Z", "UniqueId": "0ac3da45-cacf-4c31-9b38-9ef3697d5a66", "WelcomePage": "" }));
  });

  it('should correctly pass params to request', async () => {
    const request: sinon.SinonStub = stubPostResponses();

    await command.action(logger, {
      options: {
        debug: true,
        webUrl: 'https://contoso.sharepoint.com',
        parentFolderUrl: '/Shared Documents',
        name: 'abc'
      }
    });
    assert(request.calledWith({
      url: 'https://contoso.sharepoint.com/_api/web/folders',
      headers:
        { accept: 'application/json;odata=nometadata' },
      data: { ServerRelativeUrl: '/Shared Documents/abc' },
      responseType: 'json'
    }));
  });

  it('should correctly pass params to request (sites/test1)', async () => {
    const request: sinon.SinonStub = stubPostResponses();

    await command.action(logger, {
      options: {
        debug: true,
        webUrl: 'https://contoso.sharepoint.com/sites/test1',
        parentFolderUrl: 'Shared Documents',
        name: 'abc'
      }
    });
    assert(request.calledWith({
      url: 'https://contoso.sharepoint.com/sites/test1/_api/web/folders',
      headers:
        { accept: 'application/json;odata=nometadata' },
      data: { ServerRelativeUrl: '/sites/test1/Shared Documents/abc' },
      responseType: 'json'
    }));
  });

  it('fails validation if the webUrl option is not a valid SharePoint site URL', async () => {
    const actual = await command.validate({ options: { webUrl: 'foo', parentFolderUrl: '/Shared Documents', name: 'My Folder' } }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if the webUrl option is a valid SharePoint site URL and parentFolderUrl specified', async () => {
    const actual = await command.validate({ options: { webUrl: 'https://contoso.sharepoint.com', parentFolderUrl: '/Shared Documents', name: 'My Folder' } }, commandInfo);
    assert.strictEqual(actual, true);
  });
});
