﻿using Gttsb.Core;
using Microsoft.AspNetCore.Mvc;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public sealed class MetadataController : ControllerBase
    {
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;

        public MetadataController(IGitHubFacadeFactory gitHubFacadeFactory)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
        }

        [HttpGet(Name = "Get Installed Orgs")]        
        public async Task<IEnumerable<Models.Installation>> GetInstalledOrgs()
        {
            var installedGitHubOrgs = await gitHubFacadeFactory.GetInstallationsAsync();

            return installedGitHubOrgs.Select(i => new Models.Installation
            {
                Id = i.Id,
                OrgName = i.OrgName
            }).ToList();
        }
    }
}