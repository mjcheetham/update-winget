<p align="center">
  <a href="https://github.com/mjcheetham/update-winget/actions"><img alt="update-winget status" src="https://github.com/mjcheetham/update-winget/workflows/build-test/badge.svg"></a>
</p>

Update a Windows Package (`winget`) from a workflow.

## Example

```yaml
- uses: mjcheetham/update-winget@v1
  with:
    token: ${{secrets.COMMIT_TOKEN}}
    id: My.Package
    version: 2.3.4
    sha256: e99fa5e39fa055c318300f65353c8256fca7cc25c16212c73da2081c5a3637f7
    manifestText: |
          Id: {{id}}
          Version: {{version}}
          Name: My Cool Application
          Publisher: Example Corp
          Homepage: https://example.com
          Installers:
              - Arch: x86
                Url: https://github.com/example/project/releases/download/v{{version}}/install-win-{{version}}.exe
                InstallerType: Inno
                Sha256: {{sha256}}
```
